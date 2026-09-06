import { asOptionalText, asRecord, asText, definePart, mapEntries } from './contracts';
import { AreaRow, ListEditor, TextRow } from './editorKit';

type Row = { time: string | null; title: string; detail: string | null };
type Group = { label: string; caption: string | null; rows: Row[] };

type PlanConfig = {
  groups: Group[];
  note: string | null;
};

/** A programme, grouped into stages so the ordering carries real meaning. */
export const planPart = definePart<PlanConfig>({
  kind: 'plan',
  label: 'Plan',
  description: 'Program pogrupowany w etapy, z godzinami.',

  defaultConfig: () => ({
    groups: [
      {
        label: 'Dzień 1',
        caption: null,
        rows: [{ time: '9:00', title: 'Zbiórka', detail: null }]
      }
    ],
    note: null
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      groups: mapEntries<Group>(record.groups, (group) => {
        const rows = mapEntries<Row>(group.rows, (row) => {
          // Nothing is dropped here: a line added to a stage is blank until it
          // is typed, and a guard would leave "add" doing nothing. The renderer
          // skips the untitled ones.
          return {
            time: asOptionalText(row.time),
            title: asText(row.title).trim(),
            detail: asOptionalText(row.detail)
          };
        });
        const label = asText(group.label).trim();
        if (label.length === 0 && rows.length === 0) return null;
        return { label: label || 'Etap', caption: asOptionalText(group.caption), rows };
      }),
      note: asOptionalText(record.note)
    };
  },

  Renderer: ({ config }) =>
    config.groups.length === 0 ? (
      <p className="ev-note">Program nie został jeszcze uzupełniony.</p>
    ) : (
      <div className="ev-plan">
        {config.groups.map((group, groupIndex) => (
          <section className="ev-plan-group" key={groupIndex}>
            <header>
              <h3>{group.label}</h3>
              {group.caption ? <p>{group.caption}</p> : null}
            </header>
            <ol className="ev-plan-rows">
              {group.rows.filter((row) => row.title.length > 0).map((row, rowIndex) => (
                <li key={rowIndex}>
                  <span className="ev-plan-time">{row.time ?? '—'}</span>
                  <span className="ev-plan-body">
                    <strong>{row.title}</strong>
                    {row.detail ? <em>{row.detail}</em> : null}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
        {config.note ? <p className="ev-note">{config.note}</p> : null}
      </div>
    ),

  Editor: ({ config, onChange }) => (
    <>
      <ListEditor<Group>
        legend="Etapy"
        items={config.groups}
        addLabel="Dodaj etap"
        blank={() => ({ label: 'Nowy etap', caption: null, rows: [] })}
        titleOf={(item) => item.label || 'Etap'}
        onChange={(groups) => onChange({ ...config, groups })}
        renderItem={(group, updateGroup) => (
          <>
            <TextRow label="Nazwa etapu" value={group.label} onChange={(label) => updateGroup({ ...group, label })} />
            <TextRow
              label="Podpis"
              value={group.caption ?? ''}
              onChange={(caption) => updateGroup({ ...group, caption: caption || null })}
            />
            <ListEditor<Row>
              legend="Punkty programu"
              items={group.rows}
              addLabel="Dodaj punkt"
              blank={() => ({ time: null, title: '', detail: null })}
              titleOf={(row, index) => row.title || `Punkt ${index + 1}`}
              onChange={(rows) => updateGroup({ ...group, rows })}
              renderItem={(row, updateRow) => (
                <>
                  <TextRow
                    label="Godzina"
                    value={row.time ?? ''}
                    onChange={(time) => updateRow({ ...row, time: time || null })}
                  />
                  <TextRow label="Co się dzieje" value={row.title} onChange={(title) => updateRow({ ...row, title })} />
                  <TextRow
                    label="Szczegóły"
                    value={row.detail ?? ''}
                    onChange={(detail) => updateRow({ ...row, detail: detail || null })}
                  />
                </>
              )}
            />
          </>
        )}
      />
      <AreaRow
        label="Uwaga"
        rows={2}
        value={config.note ?? ''}
        onChange={(note) => onChange({ ...config, note: note || null })}
      />
    </>
  )
});
