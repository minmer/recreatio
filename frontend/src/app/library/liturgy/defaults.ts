/** Structural defaults only: no prayers or copyrighted editions are bundled. */
import { GILH, NORMS } from './calendar';
import { EntitySchema, HOURS, type Hour, type LitEntity, type OfType, type SourceLayer } from './schema';
const structural = (hour: Hour, names: string[]): OfType<'liturgical_template'> => EntitySchema.parse({
  schema_version: '1.0', entity_type: 'liturgical_template', id: `roman.template.${hour}`, title: hour, status: 'draft',
  hour_or_rite: hour, authority_reference: `${GILH}#II`, slots: names.map(name => ({ name, label: name, required: !['psalmody.2.optional', 'examination'].includes(name),
    ...(name === 'te_deum' ? { conditions: { te_deum: true } } : name === 'opening' && (hour === 'readings' || hour === 'lauds') ? { conditions: { after_invitatory: false } } : {}),
    source_order: name === 'opening' || name === 'lords_prayer' || name === 'conclusion' || name === 'blessing' ? ['ordinary', 'time', 'saints'] : ['local', 'saints', 'time', 'common', 'psalter', 'lectionary', 'ordinary']
  }))
}) as OfType<'liturgical_template'>;
const psalmody = ['psalmody.1', 'psalmody.2', 'psalmody.3'];
export const TEMPLATES = [
  structural('invitatory', ['opening', 'invitatory']),
  structural('readings', ['opening', 'hymn', ...psalmody, 'versicle', 'reading.1', 'responsory.1', 'reading.2', 'responsory.2', 'te_deum', 'prayer', 'conclusion']),
  ...(['lauds', 'vespers'] as const).map(hour => structural(hour, ['opening', 'hymn', ...psalmody, 'reading', 'responsory', 'gospel_canticle', 'intercessions', 'lords_prayer', 'prayer', 'conclusion'])),
  ...(['terce', 'sext', 'none'] as const).map(hour => structural(hour, ['opening', 'hymn', ...psalmody, 'reading', 'versicle', 'prayer', 'conclusion'])),
  structural('compline', ['opening', 'examination', 'hymn', 'psalmody.1', 'psalmody.2.optional', 'reading', 'responsory', 'gospel_canticle', 'prayer', 'blessing', 'marian_antiphon']),
  structural('mass', ['entrance', 'collect', 'reading.1', 'psalm', 'reading.2', 'acclamation', 'gospel', 'offertory', 'prayer_over_offerings', 'preface', 'communion', 'prayer_after_communion'])
];
// Weekday variants and special rites supply their own reviewed templates.
TEMPLATES.find(t => t.hour_or_rite === 'mass')!.slots.find(s => s.name === 'reading.2')!.conditions = { weekdays: [7] };
const obs = (id: string, title: string, precedence: number, rule: unknown, color = 'white', scope = 'roman'): LitEntity => EntitySchema.parse({
  schema_version: '1.0', entity_type: 'calendar_observance', id, title, status: 'approved',
  precedence_class: precedence, liturgical_rank: precedence <= 4 ? 'solemnity' : 'feast', date_rule: rule,
  calendar_scope: scope, liturgical_color: color, first_vespers: precedence <= 4, authority_reference: NORMS
});
const fixed = (month: number, day: number) => ({ r: 'fixed', month, day });
const relative = (offset: number) => ({ r: 'easter', offset });
export const CORE_OBSERVANCES: LitEntity[] = [
  obs('roman.christmas', 'Narodzenie Pańskie', 2, fixed(12, 25)),
  obs('roman.mary-mother', 'Świętej Bożej Rodzicielki Maryi', 3, fixed(1, 1)),
  obs('roman.epiphany', 'Objawienie Pańskie', 2, fixed(1, 6)),
  obs('roman.baptism', 'Chrzest Pański', 5, { r: 'baptism' }),
  obs('roman.holy-family', 'Świętej Rodziny', 5, { r: 'christmas-sunday' }),
  obs('roman.ascension', 'Wniebowstąpienie Pańskie', 2, relative(39)),
  obs('roman.pentecost', 'Zesłanie Ducha Świętego', 2, relative(49), 'red'),
  obs('roman.trinity', 'Najświętszej Trójcy', 3, relative(56)),
  obs('roman.corpus-christi', 'Najświętszego Ciała i Krwi Chrystusa', 3, relative(60)),
  obs('roman.sacred-heart', 'Najświętszego Serca Pana Jezusa', 3, relative(68)),
  obs('roman.christ-king', 'Jezusa Chrystusa, Króla Wszechświata', 3, { r: 'advent', offset: -7 }),
  obs('roman.joseph', 'Świętego Józefa', 3, fixed(3, 19)),
  obs('roman.annunciation', 'Zwiastowanie Pańskie', 3, fixed(3, 25)),
  obs('roman.assumption', 'Wniebowzięcie Najświętszej Maryi Panny', 3, fixed(8, 15)),
  obs('roman.all-saints', 'Wszystkich Świętych', 3, fixed(11, 1)),
  { ...obs('roman.all-souls', 'Wspomnienie wszystkich wiernych zmarłych', 3, fixed(11, 2), 'violet'), liturgical_rank: 'day', first_vespers: false } as LitEntity,
  obs('roman.immaculate-conception', 'Niepokalane Poczęcie Najświętszej Maryi Panny', 3, fixed(12, 8)),
  obs('PL.queen-mary', 'Najświętszej Maryi Panny, Królowej Polski', 4, fixed(5, 3), 'white', 'PL')
];
const rule = (id: string, action: unknown, scope = 'roman', authority = `${NORMS}#60`, priority = 0, conditions = {}): LitEntity => EntitySchema.parse({
  schema_version: '1.0', entity_type: 'liturgical_rule', id, title: id, status: 'approved', applicable_calendar: scope, authority_reference: authority, priority, conditions, action
});
export const CORE_RULES: LitEntity[] = [
  rule('PL.ascension.sunday', { type: 'date_override', observance_id: 'roman.ascension', date_rule: relative(42) }, 'PL', 'https://kkbids-old.episkopat.pl/index.php?id=300#25'),
  rule('PL.queen-mary.2026', { type: 'date_override', observance_id: 'PL.queen-mary', year: 2026, date_rule: fixed(5, 2) }, 'PL', 'https://episkopat.pl/doc/229149.Uroczystosc-NMP-Krolowej-Polski-w-roku-2026-2-maja', 100),
  ...['roman.immaculate-conception', 'roman.annunciation', 'roman.joseph', 'PL.queen-mary'].map(id => rule(`${id}.transfer`, { type: 'transfer', observance_id: id, strategy: 'next_free', max_days: 30 }, id.startsWith('PL.') ? 'PL' : 'roman')),
  rule('roman.joseph.before-holy-week', { type: 'transfer', observance_id: 'roman.joseph', strategy: 'previous_free', max_days: 10, latest: relative(-8) }, 'roman', 'https://kkbids-old.episkopat.pl/index.php?id=301#60', 100, { seasons: ['holy_week', 'triduum'] })
];
export const BUILTINS: readonly LitEntity[] = [...CORE_OBSERVANCES, ...CORE_RULES, ...TEMPLATES];
/** User revisions override the same stable ID; the defaults remain available for an empty collection. */
export const effectiveEntities = (own: readonly LitEntity[]): LitEntity[] => [...new Map([...BUILTINS, ...own].map(e => [e.id, e])).values()];
export const DEFAULT_LAYERS: SourceLayer[] = ['local', 'saints', 'time', 'common', 'psalter', 'lectionary', 'ordinary'];
export const OFFICE_HOURS = HOURS.filter((h): h is Exclude<Hour, 'mass'> => h !== 'mass');
