/**
 * Deterministic composition: returns references, resolved parts and the decisions actually made.
 *
 * 2026-11-09 (2.0) — ein Platz zeigt TEILE: die Antiphon (mit ihrer gewählten Teilung), den Text oder sein Fragment, die
 * Doxologie (wo der Platz sie will und der Text sie nicht ausschliesst), die wiederkehrende Antiphon (davor und danach,
 * oder nach jeder Strophe des Wezwanie). Jeder Teil hat seine liturgischen Zeilen und seinen fortlaufenden Text — beide
 * aus demselben Brzmienie. Ein Gebet nimmt den Schluss, dessen Bedingungen passen (z. B. den kurzen in den Kleinen Horen).
 */
import { matches, resolveLiturgicalDay, resolveVespers, type LiturgicalDay, type SelectionContext } from './calendar';
import { DEFAULT_LAYERS, OFFICE_HOURS } from './defaults';
import { indexOf, resolveText } from './resources';
import type { CalendarContext, Hour, LitEntity, OfType, SourceLayer, TextResource, Unit } from './schema';
import { layoutOf, modeOf, paragraphs, performanceLines, plainOfLines, unitLines, type Line } from './text';

export interface ShownPart {
  readonly kind: 'main' | 'antiphon' | 'antiphon_repeat' | 'doxology';
  readonly resourceId: string;
  /** Liturgische Ansicht. */
  readonly lines: readonly Line[];
  /** Fortlaufende Ansicht: Absätze, wie gelesen. */
  readonly plain: readonly string[];
}
export interface ResolvedSlot {
  name: string; label: string; required: boolean; resourceId?: string; canonicalResourceId?: string; editionId?: string;
  parts: ShownPart[]; units: Unit[]; antiphon?: { id: string; editionId: string; layout?: string; repeat: string };
  status: 'ready' | 'missing' | 'unreviewed' | 'omitted';
  sourceLayer?: SourceLayer; assignmentId?: string; ruleId?: string; celebrationId: string;
  reason: string; authority?: string; fallback?: string; rejected: string[];
  /** Die Doxologie: angefügt, bezeugt weggelassen, vom Platz nicht verlangt, oder verlangt und nicht gefunden. */
  doxology?: 'appended' | 'omitted' | 'missing'; variantId?: string; partLabel?: string;
}
export interface Composition {
  requestedDate: string; hour: Hour; day: LiturgicalDay; vespers?: 'first' | 'second'; templateId?: string;
  slots: ResolvedSlot[]; diagnostics: string[]; complete: boolean;
}
export interface ComposeOptions { psalmody?: 'current' | 'complementary'; afterInvitatory?: boolean; templateId?: string }

/** Ein Schluss oder eine andere bezeugte Variante ersetzt die Folge von Einheiten ab `replaces` (dieselbe Art) — als eigener Text. */
function withVariant(r: TextResource, units: readonly Unit[], variant: NonNullable<TextResource['variants']>[number]): { text: string; units: Unit[] } {
  const start = units.findIndex((u) => u.id === variant.replaces);
  if (start < 0) return { text: r.text, units: [...units] };
  let end = start + 1;
  while (end < units.length && units[start].kind !== undefined && units[end].kind === units[start].kind) end++;
  const text = `${r.text}\n${variant.text}`;
  const at = r.text.length + 1;
  const replaced: Unit = { ...units[start], at, to: text.length, end: units[end - 1].end };
  return { text, units: [...units.slice(0, start), replaced, ...units.slice(end)] };
}

/** Teile eines Haupttexts als Strophen (für die Antiphon des Wezwanie nach jeder Strophe). */
function strophes(units: readonly Unit[]): Unit[][] {
  const out: Unit[][] = [[]];
  for (const u of units) { out[out.length - 1].push(u); if (u.end === 'stanza' || u.end === 'part') out.push([]); }
  return out.filter((g) => g.length > 0);
}

export function composeOffice(date: string, hour: Hour, context: CalendarContext, entities: readonly LitEntity[], options: ComposeOptions = {}): Composition {
  const vespers = hour === 'vespers' || hour === 'compline' ? resolveVespers(date, context, entities) : null;
  const day = vespers?.day ?? resolveLiturgicalDay(date, context, entities);
  const x: SelectionContext = { day, calendar: context, hour, vespers: vespers?.vespers, psalmody: options.psalmody, afterInvitatory: options.afterInvitatory };
  const result: Composition = { requestedDate: date, hour, day, ...(vespers ? { vespers: vespers.vespers } : {}), slots: [], diagnostics: [...day.diagnostics], complete: false };
  const templates = entities.filter((e): e is OfType<'liturgical_template'> => e.entity_type === 'liturgical_template' && e.hour_or_rite === hour && matches(e.applicability, x) && (!options.templateId || e.id === options.templateId)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const template = templates[0];
  if (!template) { result.diagnostics.push('missing_template'); return result; }
  result.templateId = template.id;
  if (day.commemoration && !template.applicability.commemorations?.includes(day.commemoration.id)) result.diagnostics.push(`commemoration_requires_template:${day.commemoration.id}`);
  if (hour === 'mass' && day.season === 'triduum' && template.id === 'roman.template.mass') { result.diagnostics.push('special_rite_required'); return result; }
  if (templates[1]?.priority === template.priority) result.diagnostics.push('ambiguous_template');
  if (template.status !== 'approved') result.diagnostics.push(`unreviewed_template:${template.id}`);
  const index = indexOf(entities);
  const look = (id: string): TextResource | undefined => { const e = index.get(id); return e?.entity_type === 'text_resource' ? e : undefined; };
  const rules = entities.filter((e): e is OfType<'liturgical_rule'> => e.entity_type === 'liturgical_rule' && context.scopes.includes(e.applicable_calendar) && matches(e.conditions, x)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  for (const s of template.slots) {
    if (!matches(s.conditions, x) && !(template.id === 'roman.template.mass' && s.name === 'reading.2' && day.selected.rank === 'solemnity')) continue;
    const slot: ResolvedSlot = { name: s.name, label: s.label, required: s.required, parts: [], units: [], status: 'missing', celebrationId: day.selected.id, reason: 'missing_assignment', rejected: [] };
    result.slots.push(slot);
    const rulesForSlot = rules.filter(r => 'slot_name' in r.action && r.action.slot_name === s.name), rule = rulesForSlot[0];
    if (rule && rulesForSlot[1]?.priority === rule.priority) { slot.reason = 'ambiguous_rule'; continue; }
    if (rule?.action.type === 'omit') { slot.status = 'omitted'; slot.reason = 'rule_omit'; slot.ruleId = rule.id; slot.authority = rule.authority_reference; if (rule.status !== 'approved') result.diagnostics.push(`unreviewed_rule:${rule.id}`); continue; }
    const layers = s.source_order ?? DEFAULT_LAYERS;
    const psalm = s.name.startsWith('psalmody.');
    const festive = day.selected.rank === 'solemnity' || day.selected.rank === 'feast' || day.season === 'easter_octave' || day.date.slice(5) >= '12-25';
    const psalterContext = festive && hour === 'lauds' && psalm ? { ...x, day: { ...day, weekday: 7, psalterWeek: 1 } } : x;
    const assignments = entities.filter((e): e is OfType<'liturgical_assignment'> => {
      if (e.entity_type !== 'liturgical_assignment' || e.slot_name !== s.name || !layers.includes(e.source_layer)) return false;
      if (e.source_layer === 'common' && (!day.selected.common || e.target_context.common !== day.selected.common)) return false;
      if (e.source_layer === 'saints' && !e.target_context.observances?.includes(day.selected.id) && !(day.commemoration && e.target_context.commemorations?.includes(day.commemoration.id))) return false;
      if (psalm && e.source_layer === 'psalter' && festive && ['readings', 'vespers'].includes(hour)) return false;
      if (psalm && options.psalmody === 'complementary' && e.target_context.psalmody !== 'complementary') return false;
      return matches(e.target_context, e.source_layer === 'psalter' ? psalterContext : x);
    });
    const score = (a: OfType<'liturgical_assignment'>) => [layers.indexOf(a.source_layer), -a.priority, -Object.keys(a.target_context).length];
    const compare = (a: OfType<'liturgical_assignment'>, b: OfType<'liturgical_assignment'>) => { const sa = score(a), sb = score(b); return sa[0] - sb[0] || sa[1] - sb[1] || sa[2] - sb[2]; };
    assignments.sort((a, b) => compare(a, b) || a.id.localeCompare(b.id));
    const assignment = assignments[0];
    slot.rejected = assignments.slice(1).map(a => a.id);
    if (!rule && assignments[1] && assignment && compare(assignment, assignments[1]) === 0) { slot.reason = 'ambiguous_assignment'; continue; }
    const ref = rule?.action.type === 'replace' ? rule.action.resource_ref : assignment?.resource_ref ?? s.resource_ref;
    if (!ref) continue;
    slot.resourceId = ref.id;
    if (rule?.action.type === 'replace') { slot.ruleId = rule.id; slot.reason = 'rule_replace'; slot.authority = rule.authority_reference; }
    else if (assignment) { slot.assignmentId = assignment.id; slot.sourceLayer = assignment.source_layer; slot.reason = 'assignment'; slot.authority = assignment.authority_reference; }
    else { slot.reason = 'template_reference'; slot.authority = template.authority_reference; }
    const layoutId = rule ? undefined : assignment?.main_layout;
    let resolved = resolveText(ref.id, index, layoutId);
    if (!resolved && assignment && !rule) {
      for (const fallback of assignment.fallback_refs ?? []) { const found = resolveText(fallback.id, index); if (found?.resource.status === 'approved' && found.resource.complete && found.resource.language === context.language) { slot.fallback = ref.id; slot.resourceId = fallback.id; resolved = found; slot.reason = 'authorized_fallback'; break; } }
    }
    if (!resolved) { slot.reason = 'missing_resource'; continue; }
    const main = resolved.resource;
    if (main.language !== context.language) { slot.reason = 'language_mismatch'; continue; }
    slot.canonicalResourceId = main.id; slot.editionId = main.edition_id;

    /* Der Haupttext: sein Fragment oder seine Teilung; ein Gebet mit dem Schluss, dessen Bedingungen passen. */
    let text = main.text;
    let units: Unit[] = resolved.units;
    const variant = (main.variants ?? []).find((v) => v.when !== undefined && matches(v.when, x));
    if (variant !== undefined) { const v = withVariant(main, units, variant); text = v.text; units = v.units; slot.variantId = variant.id; }
    slot.units = units;
    const mode = modeOf(main.resource_type);
    const partNote = resolved.passage?.part === undefined ? [] : [{ type: 'part' as const, text: resolved.passage.part, at: 'start' }];
    const notes = [...partNote, ...(main.notes ?? [])];
    if (resolved.passage?.part !== undefined) slot.partLabel = resolved.passage.part;
    const intro: Line[] = main.intro_formula === undefined ? [] : [{ kind: 'text', role: 'presider', segs: [{ text: main.intro_formula, style: 'bold' }] }];
    const usePerformance = resolved.passage === undefined && variant === undefined && (main.performance?.length ?? 0) > 0;
    const mainLines = usePerformance ? performanceLines({ ...main, notes }, main.performance!, look) : unitLines(text, units, mode, { notes });
    const mainPlain = usePerformance || resolved.passage !== undefined || variant !== undefined ? plainOfLines(mainLines) : paragraphs(main.text);
    const mainPart = (lines: readonly Line[], plain: readonly string[]): ShownPart => ({ kind: 'main', resourceId: main.id, lines, plain });

    /* Die Antiphon: welche Teilung, wo sie wiederkehrt. Beim Wiederholen steht die Mediante als „/" (wie gedruckt). */
    const antiphon = assignment?.antiphon_ref && !rule ? look(assignment.antiphon_ref) : undefined;
    const repeat = assignment?.antiphon_repeat ?? s.antiphon_repeat ?? 'around';
    const antLines = (again: boolean): ShownPart | null => {
      if (antiphon === undefined) return null;
      const lines = unitLines(antiphon.text, layoutOf(antiphon, assignment?.antiphon_layout), 'prose', { repeat: again });
      return { kind: again ? 'antiphon_repeat' : 'antiphon', resourceId: antiphon.id, lines, plain: [antiphon.text.replace(/\s+/g, ' ').trim()] };
    };
    if (assignment?.antiphon_ref && !rule) {
      if (antiphon === undefined || antiphon.language !== context.language) { slot.status = 'missing'; slot.reason = 'missing_antiphon'; continue; }
      slot.antiphon = { id: antiphon.id, editionId: antiphon.edition_id, ...(assignment.antiphon_layout === undefined ? {} : { layout: assignment.antiphon_layout }), repeat };
    }

    /* Die Doxologie: verlangt der Platz (oder das Przypisanie) sie, und schliesst der Text sie nicht aus? */
    const wants = (assignment?.doxology ?? s.doxology ?? false) && (mode === 'verse' && main.resource_type !== 'doxology');
    let doxologyPart: ShownPart | null = null;
    if (wants && main.doxology === 'none') slot.doxology = 'omitted';
    else if (assignment?.doxology === false && (s.doxology ?? false)) slot.doxology = 'omitted';
    else if (wants) {
      const dox = (main.doxology_ref ? look(main.doxology_ref) : undefined)
        ?? [...new Set(index.values())].find((e): e is TextResource => e.entity_type === 'text_resource' && e.resource_type === 'doxology' && e.edition_id === main.edition_id)
        ?? [...new Set(index.values())].find((e): e is TextResource => e.entity_type === 'text_resource' && e.resource_type === 'doxology' && e.language === main.language);
      if (dox === undefined) { slot.doxology = 'missing'; result.diagnostics.push(`missing_doxology:${s.name}`); }
      else { slot.doxology = 'appended'; doxologyPart = { kind: 'doxology', resourceId: dox.id, lines: unitLines(dox.text, layoutOf(dox), 'verse'), plain: paragraphs(dox.text) }; }
    }

    const first = repeat === 'none' || repeat === 'after' ? null : antLines(false);
    const last = repeat === 'around' || repeat === 'after' || repeat === 'strophes' ? antLines(repeat !== 'after') : null;
    if (first) slot.parts.push(first);
    if (repeat === 'strophes' && antiphon !== undefined && !usePerformance) {
      /* Wezwanie: nach jeder Strophe die Antiphon, nach der Doxologie noch einmal. */
      const groups = strophes(units);
      groups.forEach((g, k) => {
        const lines = unitLines(text, g, mode, { notes: k === 0 ? notes : [] });
        slot.parts.push(mainPart(lines, plainOfLines(lines)));
        if (k < groups.length - 1 || doxologyPart === null) slot.parts.push(antLines(true)!);
      });
      if (doxologyPart) { slot.parts.push(doxologyPart); slot.parts.push(antLines(true)!); }
    } else {
      slot.parts.push(mainPart([...intro, ...mainLines], [...(main.intro_formula === undefined ? [] : [main.intro_formula]), ...mainPlain]));
      if (doxologyPart) slot.parts.push(doxologyPart);
      if (last) slot.parts.push(last);
    }

    slot.status = main.status === 'approved' && main.complete && (!resolved.passage || resolved.passage.status === 'approved') && (!assignment || assignment.status === 'approved') && (!rule || rule.status === 'approved') ? 'ready' : 'unreviewed';
    if (antiphon !== undefined && (antiphon.status !== 'approved' || !antiphon.complete)) slot.status = 'unreviewed';
    if (slot.doxology === 'missing') slot.status = 'unreviewed';
  }
  result.complete = result.diagnostics.length === 0 && result.slots.every(s => s.status === 'ready' || s.status === 'omitted' || !s.required && s.status === 'missing');
  return result;
}
export const composeMass = (date: string, context: CalendarContext, entities: readonly LitEntity[], options: ComposeOptions = {}) => composeOffice(date, 'mass', context, entities, options);
export const composeAllHours = (date: string, context: CalendarContext, entities: readonly LitEntity[]) => OFFICE_HOURS.map(hour => composeOffice(date, hour, context, entities, { afterInvitatory: hour === 'readings', psalmody: hour === 'sext' || hour === 'none' ? 'complementary' : 'current' }));
