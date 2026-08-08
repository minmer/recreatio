import { asOptionalText, asRecord, asText, definePart, mapEntries } from './contracts';
import { AreaRow, ListEditor, TextRow } from './editorKit';

type Info = { label: string; value: string; detail: string | null };

type ShortInfosConfig = {
  items: Info[];
  note: string | null;
};

/** The facts someone needs before reading anything else: when, where, how far. */
export const shortInfosPart = definePart<ShortInfosConfig>({
  kind: 'shortinfos',
  label: 'Krótkie informacje',
  description: 'Rząd najważniejszych faktów — termin, miejsce, dystans, koszt.',

  defaultConfig: () => ({
    items: [
      { label: 'Termin', value: '28–29.08.2026', detail: null },
      { label: 'Miejsce', value: 'Kraków → Częstochowa', detail: null }
    ],
    note: null
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      items: mapEntries<Info>(record.items, (item) => {
        const label = asText(item.label).trim();
        const value = asText(item.value).trim();
        if (label.length === 0 && value.length === 0) return null;
        return { label, value, detail: asOptionalText(item.detail) };
      }),
      note: asOptionalText(record.note)
    };
  },

  Renderer: ({ config }) => (
    <div className="e2-shortinfos">
      {config.items.length > 0 ? (
        <dl className="e2-shortinfos-grid">
          {config.items.map((item, index) => (
            <div key={index}>
              <dt>{item.label}</dt>
              <dd>{item.value}</dd>
              {item.detail ? <p>{item.detail}</p> : null}
            </div>
          ))}
        </dl>
      ) : (
        <p className="e2-note">Nie dodano jeszcze żadnych informacji.</p>
      )}
      {config.note ? <p className="e2-note">{config.note}</p> : null}
    </div>
  ),

  Editor: ({ config, onChange }) => (
    <>
      <ListEditor<Info>
        legend="Informacje"
        items={config.items}
        addLabel="Dodaj informację"
        blank={() => ({ label: 'Etykieta', value: '', detail: null })}
        titleOf={(item) => item.label || 'Informacja'}
        onChange={(items) => onChange({ ...config, items })}
        renderItem={(item, update) => (
          <>
            <TextRow label="Etykieta" value={item.label} onChange={(label) => update({ ...item, label })} />
            <TextRow label="Wartość" value={item.value} onChange={(value) => update({ ...item, value })} />
            <TextRow
              label="Doprecyzowanie"
              value={item.detail ?? ''}
              onChange={(detail) => update({ ...item, detail: detail || null })}
            />
          </>
        )}
      />
      <AreaRow
        label="Uwaga pod spodem"
        rows={2}
        value={config.note ?? ''}
        onChange={(note) => onChange({ ...config, note: note || null })}
      />
    </>
  )
});
