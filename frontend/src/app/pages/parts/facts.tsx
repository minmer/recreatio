/**
 * KRÓTKIE INFORMACJE — was man vor allem anderen wissen muss: wann, wo, wie
 * weit, wie viel (Altbestand: `ShortInfosPart`).
 *
 * <b>Je Grösse:</b> im Streifen die Fakten nebeneinander, ohne Erläuterung;
 * als Block und hoch mit Erläuterung und der Notiz darunter.
 */

import { t, useT } from '../../core/i18n';
import { AreaRow, asOptionalText, asRecord, asText, defineEventPart, ListEditor, mapEntries, TextRow } from '../event/kit';

type Info = { label: string; value: string; detail: string | null };

type ShortInfosConfig = { items: Info[]; note: string | null };

export const factsPart = defineEventPart<ShortInfosConfig>({
  kind: 'shortinfos',
  label: 'moduleContent.facts.label',
  use: 'moduleContent.facts.use',
  box: { colSpan: 6, rowSpan: 1 },

  blank: () => ({ items: [], note: null }),
  example: () => ({
    items: [
      { label: 'Termin', value: '28–29.08.2026', detail: null }, // i18n-ignore
      { label: 'Miejsce', value: 'Kraków → Częstochowa', detail: '140 km w dwa dni' }, // i18n-ignore
      { label: 'Koszt', value: '250 zł', detail: 'nocleg i wyżywienie' } // i18n-ignore
    ],
    note: null
  }),

  /* 0064 — was jeder Schlüssel im JSON bedeutet (die Beschreibung neben dem Import). */
  keys: {
    items: 'moduleContent.facts.key.items',
    'items[].label': 'moduleContent.facts.key.label',
    'items[].value': 'moduleContent.facts.key.value',
    'items[].detail': 'moduleContent.facts.key.detail',
    note: 'moduleContent.facts.key.note'
  },

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      items: mapEntries<Info>(record.items, (item) => ({
        label: asText(item.label).trim(),
        value: asText(item.value).trim(),
        detail: asOptionalText(item.detail)
      })),
      note: asOptionalText(record.note)
    };
  },

  hasContent: (c) => c.items.some((item) => item.label !== '' || item.value !== ''),

  shows: (_c, size) => size.height === 'strip' ? t('moduleContent.facts.showsStrip') : t('moduleContent.facts.showsAll'),

  Body: ({ config, ctx }) => {
    const strip = ctx.size.height === 'strip';
    const items = config.items.filter((item) => item.label !== '' || item.value !== '');
    return (
      <div className={`ev-shortinfos${strip ? ' is-strip' : ''}`}>
        <dl className="ev-shortinfos-grid">
          {items.map((item, index) => (
            <div key={index}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
              {!strip && item.detail !== null && <p>{item.detail}</p>}
            </div>
          ))}
        </dl>
        {!strip && config.note !== null && <p className="ev-note">{config.note}</p>}
      </div>
    );
  },

  Edit: function FactsEdit({ config, onChange }) {
    const t = useT();
    return (
    <>
      <ListEditor<Info>
        legend={t('moduleContent.facts.legend')}
        items={config.items}
        addLabel={t('moduleContent.facts.add')}
        blank={() => ({ label: '', value: '', detail: null })}
        titleOf={(item, index) => item.label || item.value || t('moduleContent.facts.nth', { n: index + 1 })}
        onChange={(items) => onChange({ ...config, items })}
        renderItem={(item, update) => (
          <>
            <TextRow label={t('moduleContent.facts.label2')} value={item.label} placeholder={t('moduleContent.facts.labelPlaceholder')} onChange={(label) => update({ ...item, label })} />
            <TextRow label={t('moduleContent.facts.value')} value={item.value} placeholder="28–29.08.2026" onChange={(value) => update({ ...item, value })} />
            <TextRow label={t('moduleContent.facts.detail')} value={item.detail ?? ''} onChange={(detail) => update({ ...item, detail: detail || null })} />
          </>
        )}
      />
      <AreaRow label={t('moduleContent.facts.note')} rows={2} value={config.note ?? ''} onChange={(note) => onChange({ ...config, note: note || null })} />
    </>
    );
  }
});
