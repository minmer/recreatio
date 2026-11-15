/**
 * DIE PRÜFUNG EINES WERKS (2026-11-15) — ein Bericht, nie eine Sperre. EINE Umsetzung für App und KI: die App zeigt
 * die Befunde, die Abschrift für den Dostęp dla AI trägt dieselben (`workBrief.ts`), und `get_work_checks` über MCP
 * gibt genau sie heraus.
 *
 * Geprüft wird je Weg (eine Ausgabe durch die Dimensionen), in seiner Lesereihenfolge. Jeder Befund nennt die Stelle
 * (Knoten, Eintrag, Regel), sagt, warum es ein Problem ist, und was es beheben würde:
 *
 *   eingeführt vor gebraucht   gebraucht, bevor es eingeführt ist · nie eingeführt (oder nur auf einem anderen Weg)
 *                              · eingeführt, nie gebraucht · zweimal eingeführt · eine Voraussetzung kommt später
 *   Regeln des Wissens         keine Definition / kein Beispiel, wo eine Regel es verlangt · Phase gilt hier nicht ·
 *                              verbotenes Synonym oder falsche Form eines Begriffs
 *   Rollen                     „neu" bringt nichts · Zusammenfassung bringt Neues oder nimmt Unbekanntes auf
 *   Gestalt                    Länge weit vom Ziel · ohne Zweck / ohne Rolle · Lücke in der Tabelle · Vorlage
 *                              geändert oder Teile fehlen
 *   Regeln am Wortlaut         Satzlänge, Wörter höchstens/mindestens, verbotene/verlangte Wendungen, genau ein Neues
 *   Quellen                    Zitat ohne Ziel · Zitat weicht vom vollen Text der Bibliothek ab
 */

import { t } from '../../core/i18n';
import { ids, isSource, markupsOf, refTarget, str, wordCount, type LibEntry, type Lookup } from '../../library/libraryKinds';
import { parseMarkup, walkBlocks } from '../../library/libraryMarkup';
import { EMPTY_KNOWLEDGE, type WorkKnowledge } from './workKnowledge';
import {
  entitiesOf, introducedElsewhere, occurrencesOf, plainOfNode, registerOf, textOf,
  type MarkLook, type Occurrence, type Register
} from './workMarks';
import { hasPhrase, numberParam, phrasesOf, rulesAt, rulesOf, sentencesOf, type WorkRule } from './workRules';
import { missingParts, readTemplate, templateSig, type UnitTemplate } from './workTemplates';
import { pathsOf, roleOf, targetOf, wordsOf, type Placed, type WorkModel, type WorkNode, type WorkPath } from './workModel';

export type Weight = 'must' | 'should' | 'info';

export const FINDING_CODES = [
  'usedBeforeIntro', 'notIntroducedHere', 'neverIntroduced', 'introducedNotUsed', 'introducedTwice', 'prerequisiteLate',
  'noDefinition', 'noExample', 'phaseInvalid', 'forbiddenForm', 'newBringsNothing', 'summaryIntroduces', 'summaryRecallsUnknown',
  'lengthOff', 'noPurpose', 'noRole', 'dimensionGap', 'templateChanged', 'templateMissingParts',
  'ruleSentence', 'ruleMaxWords', 'ruleMinWords', 'ruleForbid', 'ruleRequire', 'ruleOneNew', 'citationMissing', 'quoteMismatch'
] as const;
export type FindingCode = (typeof FINDING_CODES)[number];

export interface Finding {
  /** Bleibt gleich, solange derselbe Befund an derselben Stelle steht. */
  readonly id: string;
  readonly code: FindingCode;
  readonly weight: Weight;
  readonly path: string;
  readonly node?: string;
  readonly entity?: string;
  readonly rule?: string;
  /** Lesbar, in der Sprache der App: was, warum, was es behebt. */
  readonly message: string;
  readonly why: string;
  readonly fix: string;
}

export interface CheckInput {
  readonly model: WorkModel;
  readonly look: MarkLook;
  readonly knowledge?: WorkKnowledge;
  /** Schon gerechnet (sonst hier). */
  readonly occurrences?: readonly Occurrence[];
  readonly rules?: readonly WorkRule[];
  /** Der volle Text eines Werks der Bibliothek, wenn er offen ist — für den Vergleich eines Zitats. */
  readonly sourcePlain?: (workId: string) => string | undefined;
}

export interface CheckReport {
  readonly path: WorkPath;
  readonly findings: readonly Finding[];
  readonly register: Register;
}

/** Wie gross die Abweichung von der Ziellänge sein darf, bevor sie gemeldet wird. */
export const LENGTH_TOLERANCE = 0.25;

const hash = (text: string): string => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
};

/** Wie ein Knoten in einem Befund heisst: Nummer und Titel. */
export function nodeName(model: WorkModel, placed: readonly Placed[], id: string): string {
  const p = placed.find((x) => x.node.id === id);
  const node = p?.node ?? model.nodes.get(id);
  if (node === undefined) return t('work.check.someNode');
  const title = node.title || t('work.untitled');
  return p === undefined ? title : `${p.number} ${title}`; // i18n-ignore — Nummer und Titel
}

/** Die Templates eines Werks (alle des Skryptorium). */
export function templatesOf(look: MarkLook): Map<string, UnitTemplate> {
  return new Map(look.all().filter((e) => e.kind === 'unittemplate').map((e) => [e.id, readTemplate(e)]));
}

/** ALLE WEGE eines Werks geprüft. */
export function checkWork(input: CheckInput): CheckReport[] {
  const occurrences = input.occurrences ?? occurrencesOf(input.model, input.look, input.knowledge);
  const rules = input.rules ?? rulesOf(input.model, input.look);
  return pathsOf(input.model).map((path) => checkPath({ ...input, occurrences, rules }, path));
}

/** EIN WEG geprüft. */
export function checkPath(input: CheckInput, path: WorkPath): CheckReport {
  const { model, look } = input;
  const knowledge = input.knowledge ?? EMPTY_KNOWLEDGE;
  const occurrences = input.occurrences ?? occurrencesOf(model, look, input.knowledge);
  const rules = input.rules ?? rulesOf(model, look);
  const register = registerOf(model, path, occurrences);
  const placed = register.placed;
  const templates = templatesOf(look);
  const out: Finding[] = [];
  const nameOf = (id: string) => nodeName(model, placed, id);
  const entityName = (id: string) => knowledge.get(id)?.label ?? look.get(id)?.data.title?.toString() ?? t('work.check.someEntry');
  const add = (code: FindingCode, weight: Weight, where: { node?: string; entity?: string; rule?: WorkRule }, params: Record<string, string | number> = {}) => {
    const full = {
      ...params,
      ...(where.node === undefined ? {} : { node: nameOf(where.node) }),
      ...(where.entity === undefined ? {} : { entity: entityName(where.entity) }),
      ...(where.rule === undefined ? {} : { rule: where.rule.rule })
    };
    out.push({
      id: hash([path.key, code, where.node ?? '', where.entity ?? '', where.rule?.id ?? '', JSON.stringify(params)].join('|')),
      code, weight, path: path.key,
      ...(where.node === undefined ? {} : { node: where.node }),
      ...(where.entity === undefined ? {} : { entity: where.entity }),
      ...(where.rule === undefined ? {} : { rule: where.rule.id }),
      message: t(`work.check.${code}.message`, full),
      why: where.rule !== undefined && where.rule.why !== '' && code.startsWith('rule') ? where.rule.why : t(`work.check.${code}.why`, full),
      fix: t(`work.check.${code}.fix`, full)
    });
  };

  /* Nur Einträge, die irgendwo ausdrücklich markiert sind, zählen für „eingeführt vor gebraucht". */
  const registered = new Set(occurrences.filter((o) => o.where !== 'implicit').map((o) => o.entity));
  const posNode = (pos: number) => placed[pos]?.node;

  /* -- Eingeführt, bevor es gebraucht wird ----------------------------------------------------------- */
  for (const [entity, reg] of register.byEntity) {
    if (!registered.has(entity)) continue;
    const intros = reg.roles.intro;
    const first = reg.firstIntro;
    const reported = new Set<string>();
    for (const o of reg.occ) {
      if (o.role === 'intro' || reported.has(o.node)) continue;
      if (first !== null && o.pos >= first) continue;
      /* Eine Wiederaufnahme ohne Einführung meldet die Zusammenfassung selbst (summaryRecallsUnknown). */
      if (o.role === 'recall' && roleOf(model, model.nodes.get(o.node)?.role ?? '')?.brings === 'nothing') continue;
      reported.add(o.node);
      const weight: Weight = o.where === 'implicit' ? 'should' : 'must';
      if (first !== null) add('usedBeforeIntro', weight, { node: o.node, entity }, { at: nameOf(posNode(first)!.id) });
      else {
        const elsewhere = introducedElsewhere(occurrences, entity, register);
        if (elsewhere.length > 0) add('notIntroducedHere', weight, { node: o.node, entity }, { elsewhere: elsewhere.map((id) => nodeName(model, [], id)).join(', ') });
        else add('neverIntroduced', weight, { node: o.node, entity });
      }
    }
    if (intros.length > 0 && !reg.occ.some((o) => o.role !== 'intro' && o.pos > intros[0].pos)) {
      add('introducedNotUsed', 'should', { node: intros[0].node, entity });
    }
    const introNodes = [...new Set(intros.map((o) => o.node))];
    if (introNodes.length > 1) add('introducedTwice', 'should', { node: introNodes[1], entity }, { first: nameOf(introNodes[0]) });
    /* Eine Voraussetzung kommt später (oder gar nicht). */
    const e = knowledge.get(entity);
    if (e !== undefined && first !== null) {
      for (const need of e.requires) {
        if (!registered.has(need)) continue;
        const needFirst = register.byEntity.get(need)?.firstIntro ?? null;
        if (needFirst === null || needFirst > first) {
          add('prerequisiteLate', 'must', { node: posNode(first)!.id, entity }, { needs: entityName(need), at: needFirst === null ? t('work.check.nowhere') : nameOf(posNode(needFirst)!.id) });
        }
      }
    }
    /* Phasen: gilt hier eine? */
    const phases = knowledge.phasesOf(entity);
    if (phases.length > 0) {
      const ranges = phases.map((ph) => rangeOf(model, register, ph.from, ph.until, look)).filter((r): r is [number, number] => r !== null);
      if (ranges.length > 0) {
        const seen = new Set<string>();
        for (const o of reg.occ) {
          if (seen.has(o.node) || ranges.some(([a, b]) => o.pos >= a && o.pos <= b)) continue;
          seen.add(o.node);
          add('phaseInvalid', 'should', { node: o.node, entity });
        }
      }
    }
  }
  /* Ein Vorkommen, das direkt auf eine Phase zeigt, ausserhalb ihres Bereichs. */
  for (const o of occurrences) {
    const ph = knowledge.get(o.entity);
    if (ph?.phaseOf === undefined || !register.posOf.has(o.node)) continue;
    const range = rangeOf(model, register, ph.from, ph.until, look);
    const pos = register.posOf.get(o.node)!;
    if (range !== null && (pos < range[0] || pos > range[1])) add('phaseInvalid', 'should', { node: o.node, entity: o.entity });
  }

  /* -- Knoten für Knoten ------------------------------------------------------------------------------- */
  for (const at of placed) {
    const node = at.node;
    const here = register.atNode.get(node.id) ?? [];
    const entitiesHere = new Set(here.map((o) => o.entity));
    const role = roleOf(model, node.role);
    if (node.purpose === '' && !node.virtual) add('noPurpose', 'info', { node: node.id });
    if (node.role === '' && !node.virtual) add('noRole', 'info', { node: node.id });
    if (role?.brings === 'new') {
      const below = subtreeOnPath(at, placed);
      const brings = below.some((p) => (register.atNode.get(p.node.id) ?? []).some((o) => o.role === 'intro' || o.role === 'def'));
      if (!brings) add('newBringsNothing', 'should', { node: node.id });
    }
    if (role?.brings === 'nothing') {
      for (const o of here) {
        if (o.role === 'intro') add('summaryIntroduces', 'must', { node: node.id, entity: o.entity });
        if (o.role === 'recall') {
          const first = register.byEntity.get(o.entity)?.firstIntro ?? null;
          if (first === null || first > at.pos) add('summaryRecallsUnknown', 'must', { node: node.id, entity: o.entity });
        }
      }
    }
    /* Länge gegen Ziel. */
    const target = targetOf(node) ?? (node.template === null ? null : templateTarget(templates.get(node.template)));
    const words = wordsOf(node, look);
    if (target !== null && words > 0 && Math.abs(words - target) > target * LENGTH_TOLERANCE) add('lengthOff', 'should', { node: node.id }, { words, target });
    /* Lücken einer Teilung auf diesem Weg. */
    if (node.split !== '') {
      const value = at.through[node.split] ?? path.choose[node.split] ?? model.dimensions.find((d) => d.key === node.split)?.values[0]?.key;
      const dim = model.dimensions.find((d) => d.key === node.split);
      if (value !== undefined && dim !== undefined && !node.children.some((c) => c.variant === value) && !node.skip.some((s) => s.value === value)) {
        add('dimensionGap', 'should', { node: node.id }, { dimension: dim.name, value: dim.values.find((v) => v.key === value)?.name ?? value });
      }
    }
    /* Vorlage. */
    if (node.template !== null) {
      const tpl = templates.get(node.template);
      if (tpl !== undefined) {
        if (node.templateSig !== '' && node.templateSig !== templateSig(tpl)) add('templateChanged', 'should', { node: node.id }, { template: tpl.name });
        const missing = missingParts(textOf(node, look), tpl);
        if (missing.length > 0 && textOf(node, look) !== undefined) add('templateMissingParts', 'should', { node: node.id }, { template: tpl.name, parts: missing.map((p) => p.title || p.id).join(', ') });
      }
    }
    /* Quellen. */
    const text = textOf(node, look);
    if (text !== undefined) {
      for (const key of missingCitations(text, look)) add('citationMissing', 'must', { node: node.id }, { key });
      if (input.sourcePlain !== undefined) for (const q of quoteMismatches(text, look, input.sourcePlain)) add('quoteMismatch', 'should', { node: node.id }, { quote: q });
    }
    /* Verbotene Formen der Begriffe, die das Werk kennt. */
    const plain = plainOfNode(node, look);
    if (plain !== '') {
      for (const e of knowledge.all()) {
        if (!registered.has(e.id)) continue;
        for (const form of e.forbidden) if (hasPhrase(plain, form)) add('forbiddenForm', 'should', { node: node.id, entity: e.id }, { form, preferred: e.preferred || e.label });
      }
    }
    /* Die Regeln, die hier gelten. */
    for (const rule of rulesAt(model, rules, at, path, entitiesHere)) ruleCheck(rule, at, plain, here, add, words, register, knowledge, entityName);
  }

  /* -- Regeln über Einträge: Definition und Beispiel -------------------------------------------------- */
  for (const rule of rules) {
    if (rule.check !== 'needsDefinition' && rule.check !== 'needsExample') continue;
    for (const [entity, reg] of register.byEntity) {
      if (!registered.has(entity) || reg.firstIntro === null) continue;
      if (rule.entity !== null && rule.entity !== entity) continue;
      const introAt = placed[reg.firstIntro];
      if (rule.entity === null && !rulesAt(model, [rule], introAt, path, new Set([entity])).length) continue;
      const wanted = rule.check === 'needsDefinition' ? reg.roles.def : reg.roles.ex;
      if (wanted.length === 0) add(rule.check === 'needsDefinition' ? 'noDefinition' : 'noExample', rule.weight, { node: introAt.node.id, entity, rule });
    }
  }

  const weightOrder: Readonly<Record<Weight, number>> = { must: 0, should: 1, info: 2 };
  const seen = new Set<string>();
  const unique = out.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)));
  const pos = (f: Finding) => (f.node === undefined ? -1 : register.posOf.get(f.node) ?? 1e9);
  return { path, register, findings: unique.sort((a, b) => weightOrder[a.weight] - weightOrder[b.weight] || pos(a) - pos(b)) };
}

/** Die Stellen unter einem Knoten auf dem Weg (er selbst eingeschlossen). */
function subtreeOnPath(at: Placed, placed: readonly Placed[]): Placed[] {
  const out: Placed[] = [at];
  for (let i = at.pos + 1; i < placed.length && placed[i].node.depth > at.node.depth; i += 1) out.push(placed[i]);
  return out;
}

const templateTarget = (tpl: UnitTemplate | undefined): number | null =>
  tpl === undefined ? null : tpl.targetWords ?? (tpl.targetMinutes === null ? null : Math.round(tpl.targetMinutes * 130));

/**
 * DER BEREICH einer Phase auf dem Weg: ab dem ersten Knoten von `from` (ein Knoten — mit allem darunter — oder ein
 * Text, dann seine Knoten) bis zum letzten von `until`. Fehlt eine Grenze: Anfang oder Ende. Liegt eine Grenze nicht
 * auf dem Weg: keine Aussage (`null`).
 */
export function rangeOf(model: WorkModel, register: Register, from: string | undefined, until: string | undefined, look: MarkLook): [number, number] | null {
  const span = (id: string): [number, number] | null => {
    const nodes = model.nodes.has(id) ? [id] : [...model.nodes.values()].filter((n) => n.text === id).map((n) => n.id);
    let lo = Infinity;
    let hi = -Infinity;
    for (const start of nodes) {
      const p = register.posOf.get(start);
      if (p === undefined) continue;
      lo = Math.min(lo, p);
      hi = Math.max(hi, p);
      const depth = model.nodes.get(start)!.depth;
      for (let i = p + 1; i < register.placed.length && register.placed[i].node.depth > depth; i += 1) hi = Math.max(hi, i);
    }
    return lo === Infinity ? null : [lo, hi];
  };
  void look;
  const a = from === undefined ? [0, 0] as [number, number] : span(from);
  const b = until === undefined ? [register.placed.length - 1, register.placed.length - 1] as [number, number] : span(until);
  if (a === null || b === null) return null;
  return [a[0], b[1]];
}

/** Die Schlüssel, die ein Text zitiert, aber niemand auflöst. */
export function missingCitations(text: LibEntry, look: Pick<Lookup, 'get' | 'byKey'>): string[] {
  const missing = new Set<string>();
  for (const source of markupsOf(text)) {
    walkBlocks(parseMarkup(source),
      (b) => { if (b.t === 'embed' && refTarget(look as Lookup, b.key) === undefined) missing.add(b.key); },
      (i) => { if (i.t === 'cite') for (const item of i.items) if (refTarget(look as Lookup, item.key) === undefined) missing.add(item.key); });
  }
  return [...missing];
}

const norm = (s: string): string => s.toLowerCase().normalize('NFKC').replace(/[„”"«»‚‘’'`]/g, '').replace(/[\s ]+/g, ' ').replace(/[\s.,;:!?…–—-]+$/u, '').trim();

/** Eingebettete Zitate, deren Wortlaut im vollen Text ihres Werks nicht steht (wo die Bibliothek ihn hat). */
export function quoteMismatches(text: LibEntry, look: MarkLook, sourcePlain: (workId: string) => string | undefined): string[] {
  const out: string[] = [];
  for (const source of markupsOf(text)) {
    walkBlocks(parseMarkup(source), (b) => {
      if (b.t !== 'embed') return;
      const quote = refTarget(look as Lookup, b.key);
      if (quote === undefined || quote.kind !== 'quote' || !isSource(quote)) return;
      const work = ids(quote.data, 'work')[0];
      const full = work === undefined ? undefined : sourcePlain(work);
      const said = norm(str(quote.data, 'text'));
      if (full === undefined || said === '') return;
      if (!norm(full).includes(said)) out.push(str(quote.data, 'text').slice(0, 80));
    }, () => undefined);
  }
  return out;
}

type Add = (code: FindingCode, weight: Weight, where: { node?: string; entity?: string; rule?: WorkRule }, params?: Record<string, string | number>) => void;

/** Was eine Regel am Wortlaut prüft. */
function ruleCheck(rule: WorkRule, at: Placed, plain: string, here: readonly Occurrence[], add: Add, words: number, register: Register,
  knowledge: WorkKnowledge, entityName: (id: string) => string): void {
  void register; void knowledge; void entityName;
  const node = at.node.id;
  const n = numberParam(rule.param);
  switch (rule.check) {
    case 'sentenceWords': {
      if (n === null || plain === '') return;
      const long = sentencesOf(plain).filter((s) => wordCount(s) > n);
      if (long.length > 0) add('ruleSentence', rule.weight, { node, rule }, { count: long.length, max: n, example: long[0].slice(0, 80) });
      return;
    }
    case 'maxWords':
      if (n !== null && words > n) add('ruleMaxWords', rule.weight, { node, rule }, { words, max: n });
      return;
    case 'minWords':
      if (n !== null && words > 0 && words < n) add('ruleMinWords', rule.weight, { node, rule }, { words, min: n });
      return;
    case 'forbid':
      for (const phrase of phrasesOf(rule.param)) if (plain !== '' && hasPhrase(plain, phrase)) add('ruleForbid', rule.weight, { node, rule }, { phrase });
      return;
    case 'require':
      if (plain === '') return;
      for (const phrase of phrasesOf(rule.param)) if (!hasPhrase(plain, phrase)) add('ruleRequire', rule.weight, { node, rule }, { phrase });
      return;
    case 'oneNew': {
      if (at.node.children.length > 0) return;
      const intros = new Set(here.filter((o) => o.role === 'intro').map((o) => o.entity)).size;
      if (intros !== 1) add('ruleOneNew', rule.weight, { node, rule }, { count: intros });
      return;
    }
    default:
  }
}

/** Was eine Liste von Befunden zählt — für Kopfzeilen. */
export function countFindings(findings: readonly Finding[]): Readonly<Record<Weight, number>> {
  return {
    must: findings.filter((f) => f.weight === 'must').length,
    should: findings.filter((f) => f.weight === 'should').length,
    info: findings.filter((f) => f.weight === 'info').length
  };
}

/** Die Einträge, die das Werk nennt — für das Laden des Wissens, bevor geprüft wird. */
export const namedEntities = (model: WorkModel, look: MarkLook): string[] => entitiesOf(occurrencesOf(model, look));

/** Die Knoten, auf denen ein Befund steht, ohne Weg — für die Zeile eines Knotens im Baum. */
export function findingsAt(reports: readonly CheckReport[], node: WorkNode): Finding[] {
  return reports.flatMap((r) => r.findings.filter((f) => f.node === node.id));
}
