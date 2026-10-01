/**
 * PLAN — ein Programm in Etappen, mit Uhrzeiten (Altbestand: `PlanPart`).
 *
 * <b>Je Grösse:</b> im Streifen klappt er auf (zu lang für eine Zeile); als
 * Block die erste Etappe ganz und die übrigen als Überschriften, die sich
 * öffnen; hoch alle Etappen offen, über die ganze Breite nebeneinander.
 */

import { useState } from 'react';

import { AreaRow, asOptionalText, asRecord, asText, count, defineEventPart, ListEditor, mapEntries, TextRow } from '../event/kit';

type Row = { time: string | null; title: string; detail: string | null };
type Group = { label: string; caption: string | null; rows: Row[] };
type PlanConfig = { groups: Group[]; note: string | null };

function Plan({ config, all }: { config: PlanConfig; all: boolean }) {
  const [open, setOpen] = useState<ReadonlySet<number>>(() => new Set([0]));
  const groups = config.groups.filter((g) => g.label !== '' || g.rows.some((r) => r.title !== ''));

  return (
    <div className="ev-plan">
      {groups.map((group, groupIndex) => {
        const shown = all || open.has(groupIndex);
        const rows = group.rows.filter((row) => row.title.length > 0);
        return (
          <section className={`ev-plan-group${shown ? '' : ' is-closed'}`} key={groupIndex}>
            <header>
              {all ? <h3>{group.label}</h3> : (
                <h3>
                  <button type="button" className="ev-plan-toggle" aria-expanded={shown}
                    onClick={() => setOpen((was) => { const next = new Set(was); if (!next.delete(groupIndex)) next.add(groupIndex); return next; })}>
                    {group.label}
                  </button>
                </h3>
              )}
              {group.caption !== null && <p>{group.caption}</p>}
              {!shown && <p className="ev-plan-count">{count(rows.length, 'punkt', 'punkty', 'punktów')}</p>}
            </header>
            {shown && (
              <ol className="ev-plan-rows">
                {rows.map((row, rowIndex) => (
                  <li key={rowIndex}>
                    <span className="ev-plan-time">{row.time ?? '—'}</span>
                    <span className="ev-plan-body">
                      <strong>{row.title}</strong>
                      {row.detail !== null && <em>{row.detail}</em>}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        );
      })}
      {config.note !== null && <p className="ev-note">{config.note}</p>}
    </div>
  );
}

export const planPart = defineEventPart<PlanConfig>({
  kind: 'plan',
  label: 'Plan',
  use: 'Program pogrupowany w etapy (dni), z godzinami.',
  box: { colSpan: 6, rowSpan: 3 },
  strip: { title: 'Plan', open: 'Pokaż program' },
  fullscreen: true,

  blank: () => ({ groups: [], note: null }),
  example: () => ({
    groups: [
      { label: 'Piątek', caption: 'Kraków → Olkusz', rows: [{ time: '7:00', title: 'Msza św. na rozpoczęcie', detail: 'Kościół św. Józefa' }, { time: '8:00', title: 'Wyjazd', detail: null }] },
      { label: 'Sobota', caption: 'Olkusz → Częstochowa', rows: [{ time: '8:30', title: 'Wyjazd', detail: null }, { time: '17:00', title: 'Jasna Góra', detail: 'Apel Jasnogórski o 21:00' }] }
    ],
    note: null
  }),

  parse: (raw) => {
    const record = asRecord(raw);
    return {
      groups: mapEntries<Group>(record.groups, (group) => ({
        /* Nichts fällt beim Lesen weg: ein Punkt ist leer, bis er getippt ist. Die Ansicht lässt die unbenannten aus. */
        label: asText(group.label).trim(),
        caption: asOptionalText(group.caption),
        rows: mapEntries<Row>(group.rows, (row) => ({ time: asOptionalText(row.time), title: asText(row.title).trim(), detail: asOptionalText(row.detail) }))
      })),
      note: asOptionalText(record.note)
    };
  },

  hasContent: (c) => c.groups.some((g) => g.rows.some((r) => r.title !== '')),

  shows: (c, size) => size.height === 'strip' ? 'Przycisk, który rozwija program.'
    : size.height === 'tall' ? `Wszystkie etapy rozwinięte (${c.groups.length}).`
    : 'Pierwszy etap rozwinięty, pozostałe do rozwinięcia.',

  Body: ({ config, ctx }) => <Plan config={config} all={ctx.size.height === 'tall' || ctx.whole === true} />,

  Edit: ({ config, onChange }) => (
    <>
      <ListEditor<Group>
        legend="Etapy"
        items={config.groups}
        addLabel="Dodaj etap"
        blank={() => ({ label: `Dzień ${config.groups.length + 1}`, caption: null, rows: [] })}
        titleOf={(item, index) => item.label || `Etap ${index + 1}`}
        onChange={(groups) => onChange({ ...config, groups })}
        renderItem={(group, updateGroup) => (
          <>
            <TextRow label="Nazwa etapu" value={group.label} onChange={(label) => updateGroup({ ...group, label })} />
            <TextRow label="Podpis" value={group.caption ?? ''} onChange={(caption) => updateGroup({ ...group, caption: caption || null })} />
            <ListEditor<Row>
              legend="Punkty programu"
              items={group.rows}
              addLabel="Dodaj punkt"
              blank={() => ({ time: null, title: '', detail: null })}
              titleOf={(row, index) => [row.time, row.title].filter(Boolean).join(' · ') || `Punkt ${index + 1}`}
              onChange={(rows) => updateGroup({ ...group, rows })}
              renderItem={(row, updateRow) => (
                <>
                  <TextRow label="Godzina" value={row.time ?? ''} placeholder="9:00" onChange={(time) => updateRow({ ...row, time: time || null })} />
                  <TextRow label="Co się dzieje" value={row.title} onChange={(title) => updateRow({ ...row, title })} />
                  <TextRow label="Szczegóły" value={row.detail ?? ''} onChange={(detail) => updateRow({ ...row, detail: detail || null })} />
                </>
              )}
            />
          </>
        )}
      />
      <AreaRow label="Uwaga" rows={2} value={config.note ?? ''} onChange={(note) => onChange({ ...config, note: note || null })} />
    </>
  )
});
