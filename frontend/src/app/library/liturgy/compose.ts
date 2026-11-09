/** Deterministic composition: returns references, resolved blocks and the decisions actually made. */
import { matches, resolveLiturgicalDay, resolveVespers, type LiturgicalDay, type SelectionContext } from './calendar';
import { DEFAULT_LAYERS, OFFICE_HOURS } from './defaults';
import { indexOf, resolveText } from './resources';
import type { CalendarContext, Hour, LitEntity, OfType, SourceLayer, TextBlock } from './schema';

export interface ResolvedSlot {
  name: string; label: string; required: boolean; resourceId?: string; canonicalResourceId?: string; editionId?: string;
  blocks: TextBlock[]; antiphon?: { id: string; editionId: string; blocks: TextBlock[] }; status: 'ready' | 'missing' | 'unreviewed' | 'omitted';
  sourceLayer?: SourceLayer; assignmentId?: string; ruleId?: string; celebrationId: string;
  reason: string; authority?: string; fallback?: string; rejected: string[];
}
export interface Composition {
  requestedDate: string; hour: Hour; day: LiturgicalDay; vespers?: 'first' | 'second'; templateId?: string;
  slots: ResolvedSlot[]; diagnostics: string[]; complete: boolean;
}
export interface ComposeOptions { psalmody?: 'current' | 'complementary'; afterInvitatory?: boolean; templateId?: string }
export function composeOffice(date: string, hour: Hour, context: CalendarContext, entities: readonly LitEntity[], options: ComposeOptions = {}): Composition {
  const vespers = hour === 'vespers' || hour === 'compline' ? resolveVespers(date, context, entities) : null;
  const day = vespers?.day ?? resolveLiturgicalDay(date, context, entities);
  const x: SelectionContext = { day, calendar: context, hour, vespers: vespers?.vespers, psalmody: options.psalmody, afterInvitatory: options.afterInvitatory };
  const result: Composition = { requestedDate: date, hour, day, ...(vespers ? { vespers: vespers.vespers } : {}), slots: [], diagnostics: [...day.diagnostics], complete: false };
  if (day.commemoration) result.diagnostics.push(`commemoration_requires_template:${day.commemoration.id}`);
  const templates = entities.filter((e): e is OfType<'liturgical_template'> => e.entity_type === 'liturgical_template' && e.hour_or_rite === hour && matches(e.applicability, x) && (!options.templateId || e.id === options.templateId)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  const template = templates[0];
  if (!template) { result.diagnostics.push('missing_template'); return result; }
  result.templateId = template.id;
  if (hour === 'mass' && day.season === 'triduum' && template.id === 'roman.template.mass') { result.diagnostics.push('special_rite_required'); return result; }
  if (templates[1]?.priority === template.priority) result.diagnostics.push('ambiguous_template');
  if (template.status !== 'approved') result.diagnostics.push(`unreviewed_template:${template.id}`);
  const index = indexOf(entities);
  const rules = entities.filter((e): e is OfType<'liturgical_rule'> => e.entity_type === 'liturgical_rule' && context.scopes.includes(e.applicable_calendar) && matches(e.conditions, x)).sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  for (const s of template.slots) {
    if (!matches(s.conditions, x) && !(template.id === 'roman.template.mass' && s.name === 'reading.2' && day.selected.rank === 'solemnity')) continue;
    const slot: ResolvedSlot = { name: s.name, label: s.label, required: s.required, blocks: [], status: 'missing', celebrationId: day.selected.id, reason: 'missing_assignment', rejected: [] };
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
      if (e.source_layer === 'saints' && !e.target_context.observances?.includes(day.selected.id)) return false;
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
    let resolved = resolveText(ref.id, index);
    if (!resolved && assignment && !rule) {
      for (const fallback of assignment.fallback_refs ?? []) { const found = resolveText(fallback.id, index); if (found?.resource.status === 'approved' && found.resource.complete && found.resource.language === context.language) { slot.fallback = ref.id; slot.resourceId = fallback.id; resolved = found; slot.reason = 'authorized_fallback'; break; } }
    }
    if (!resolved) { slot.reason = 'missing_resource'; continue; }
    if (resolved.resource.language !== context.language) { slot.reason = 'language_mismatch'; continue; }
    slot.canonicalResourceId = resolved.resource.id; slot.editionId = resolved.resource.edition_id; slot.blocks = resolved.blocks;
    slot.status = resolved.resource.status === 'approved' && resolved.resource.complete && (!resolved.passage || resolved.passage.status === 'approved') && (!assignment || assignment.status === 'approved') && (!rule || rule.status === 'approved') ? 'ready' : 'unreviewed';
    if (assignment?.antiphon_ref && !rule) {
      const antiphon = resolveText(assignment.antiphon_ref, index);
      if (!antiphon || antiphon.resource.language !== context.language) { slot.status = 'missing'; slot.reason = 'missing_antiphon'; }
      else { slot.antiphon = { id: assignment.antiphon_ref, editionId: antiphon.resource.edition_id, blocks: antiphon.blocks }; if (antiphon.resource.status !== 'approved' || !antiphon.resource.complete) slot.status = 'unreviewed'; }
    }
  }
  result.complete = result.diagnostics.length === 0 && result.slots.every(s => s.status === 'ready' || s.status === 'omitted' || !s.required && s.status === 'missing');
  return result;
}
export const composeMass = (date: string, context: CalendarContext, entities: readonly LitEntity[], options: ComposeOptions = {}) => composeOffice(date, 'mass', context, entities, options);
export const composeAllHours = (date: string, context: CalendarContext, entities: readonly LitEntity[]) => OFFICE_HOURS.map(hour => composeOffice(date, hour, context, entities, { afterInvitatory: hour === 'readings', psalmody: hour === 'sext' || hour === 'none' ? 'complementary' : 'current' }));
