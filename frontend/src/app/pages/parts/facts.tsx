/**
 * KRÓTKIE INFORMACJE — was man vor allem anderen wissen muss: wann, wo, wie
 * weit, wie viel (Altbestand: `ShortInfosPart`).
 *
 * <b>Je Grösse:</b> im Streifen die Fakten nebeneinander, ohne Erläuterung;
 * als Block und hoch mit Erläuterung und der Notiz darunter.
 */

import { AreaRow, asOptionalText, asRecord, asText, defineEventPart, ListEditor, mapEntries, TextRow } from '../event/kit';

type Info = { label: string; value: string; detail: string | null };

type ShortInfosConfig = { items: Info[]; note: string | null };

export const factsPart = defineEventPart<ShortInfosConfig>({
  kind: 'shortinfos',
  label: 'Krótkie informacje',
  use: 'Rząd najważniejszych faktów — termin, miejsce, dystans, koszt.',
  box: { colSpan: 6, rowSpan: 1 },

  blank: () => ({ items: [], note: null }),
  example: () => ({
    items: [
      { label: 'Termin', value: '28–29.08.2026', detail: null },
      { label: 'Miejsce', value: 'Kraków → Częstochowa', detail: '140 km w dwa dni' },
      { label: 'Koszt', value: '250 zł', detail: 'nocleg i wyżywienie' }
    ],
    note: null
  }),

  /* 0064 — was jeder Schlüssel im JSON bedeutet (die Beschreibung neben dem Import). */
  keys: {
    items: 'Krótkie informacje — lista',
    'items[].label': 'Etykieta, np. "Termin"',
    'items[].value': 'Wartość, np. "28–29.08.2026"',
    'items[].detail': 'Doprecyzowanie pod wartością (albo null; w pasku niewidoczne)',
    note: 'Uwaga pod spodem (albo null)'
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

  shows: (_c, size) => size.height === 'strip' ? 'Fakty w jednym rzędzie, bez doprecyzowań.' : 'Fakty z doprecyzowaniem i uwagą pod spodem.',

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

  Edit: ({ config, onChange }) => (
    <>
      <ListEditor<Info>
        legend="Informacje"
        items={config.items}
        addLabel="Dodaj informację"
        blank={() => ({ label: '', value: '', detail: null })}
        titleOf={(item, index) => item.label || item.value || `Informacja ${index + 1}`}
        onChange={(items) => onChange({ ...config, items })}
        renderItem={(item, update) => (
          <>
            <TextRow label="Etykieta" value={item.label} placeholder="Termin" onChange={(label) => update({ ...item, label })} />
            <TextRow label="Wartość" value={item.value} placeholder="28–29.08.2026" onChange={(value) => update({ ...item, value })} />
            <TextRow label="Doprecyzowanie" value={item.detail ?? ''} onChange={(detail) => update({ ...item, detail: detail || null })} />
          </>
        )}
      />
      <AreaRow label="Uwaga pod spodem" rows={2} value={config.note ?? ''} onChange={(note) => onChange({ ...config, note: note || null })} />
    </>
  )
});
